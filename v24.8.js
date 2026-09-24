// SAIKO Construction AI v24.8
// Live per-project Google Sheet Schedule + Actual Progress sync with fuzzy scope matching.
(function(){
  let syncing=false;

  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clean=s=>String(s??'').trim();
  const norm=s=>clean(s).toLowerCase()
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\b(works?|work|scope|of|the|for|and|installation|supply|complete|including|item)\b/g,' ')
    .replace(/\s+/g,' ').trim();
  const tokens=s=>new Set(norm(s).split(' ').filter(x=>x.length>1));

  function similarity(a,b){
    const A=norm(a),B=norm(b);
    if(!A||!B)return 0;
    if(A===B)return 1;
    if(A.includes(B)||B.includes(A))return .90;
    const ta=tokens(A),tb=tokens(B);
    let inter=0;ta.forEach(x=>{if(tb.has(x))inter++});
    const union=new Set([...ta,...tb]).size||1;
    const j=inter/union;
    const dice=(2*inter)/Math.max(1,ta.size+tb.size);
    return Math.max(j,dice);
  }

  function bestMatch(name,rows,used=null){
    let best=null,score=0;
    for(const r of rows){
      if(used?.has(r))continue;
      const s=similarity(name,r.activity);
      if(s>score){score=s;best=r}
    }
    return score>=.48?{row:best,score}:null;
  }

  function selectedProject(id){
    const pid=$(id)?.value||$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function detectHeader(rows,kind){
    const aliases=kind==='schedule'
      ? {
          activity:['activity','task','description','scope','scope of work','work item','work description','item description'],
          start:['start','start date','planned start','date start'],
          end:['end','end date','finish','finish date','planned finish','date finish'],
          weight:['weight','weight %','weightage','percentage','weighted %','wt %','%']
        }
      : {
          activity:['activity','task','description','scope','scope of work','work item','work description','item description'],
          weight:['weight','weight %','weightage','percentage','weighted %','wt %','%'],
          actual:['actual','actual %','actual percent','actual progress','accomplishment','accomplishment %','progress','progress %','percent complete','% complete']
        };
    const normalizeHeader=s=>clean(s).toLowerCase().replace(/[^a-z0-9%]+/g,' ').replace(/\s+/g,' ').trim();
    let best=null;
    for(let ri=0;ri<Math.min(rows.length,25);ri++){
      const row=rows[ri].map(normalizeHeader);
      const cols={};let score=0;
      for(const [key,names] of Object.entries(aliases)){
        let found=-1;
        for(let ci=0;ci<row.length;ci++){
          const h=row[ci];
          if(names.some(a=>h===a||h.includes(a))){found=ci;break}
        }
        if(found>=0){cols[key]=found;score++}
      }
      const required=kind==='schedule'?['activity','start','end']:['activity','actual'];
      if(required.every(k=>cols[k]!=null) && (!best||score>best.score))best={rowIndex:ri,cols,score};
    }
    return best;
  }

  function parseDate(v){
    if(v==null||v==='')return null;

    // Excel/Google Sheets serial date (e.g. 46200).
    // 1899-12-30 matches Excel's serial-date system including its historical leap-year quirk.
    if(typeof v==='number' && Number.isFinite(v)){
      if(v>20000 && v<80000){
        const ms=Date.UTC(1899,11,30)+Math.round(v*86400000);
        const d=new Date(ms);
        if(!Number.isNaN(d.getTime())){
          const y=d.getUTCFullYear();
          if(y>=2000 && y<=2100)return d.toISOString().slice(0,10);
        }
      }
      return null;
    }

    // ExcelJS date values can arrive as Date objects.
    if(v instanceof Date){
      if(Number.isNaN(v.getTime()))return null;
      const y=v.getFullYear();
      if(y<2000||y>2100)return null;
      const mm=String(v.getMonth()+1).padStart(2,'0');
      const dd=String(v.getDate()).padStart(2,'0');
      return `${y}-${mm}-${dd}`;
    }

    let s=clean(v);
    if(!s)return null;

    // Numeric serial exported as text.
    if(/^\d+(\.\d+)?$/.test(s)){
      const serial=Number(s);
      if(serial>20000 && serial<80000){
        const ms=Date.UTC(1899,11,30)+Math.round(serial*86400000);
        const d=new Date(ms);
        if(!Number.isNaN(d.getTime())){
          const y=d.getUTCFullYear();
          if(y>=2000 && y<=2100)return d.toISOString().slice(0,10);
        }
      }
    }

    // ISO yyyy-mm-dd / yyyy/mm/dd
    let m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if(m){
      const y=Number(m[1]),mo=Number(m[2]),day=Number(m[3]);
      if(y>=2000&&y<=2100&&mo>=1&&mo<=12&&day>=1&&day<=31){
        return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      }
      return null;
    }

    // US-style m/d/yyyy or m-d-yyyy as commonly exported by Sheets.
    m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(m){
      let y=Number(m[3]);if(y<100)y+=2000;
      const mo=Number(m[1]),day=Number(m[2]);
      if(y>=2000&&y<=2100&&mo>=1&&mo<=12&&day>=1&&day<=31){
        return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      }
      return null;
    }

    // Month-name dates such as "September 4, 2026".
    const d=new Date(s);
    if(Number.isNaN(d.getTime()))return null;
    const y=d.getFullYear();
    if(y<2000||y>2100)return null;
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${y}-${mm}-${dd}`;
  }


  // v25.3 — Reads one visible summary value per scope/section.
  //
  // Supported block layout example:
  // CEILING WORKS
  // DESCRIPTION | TOTAL | TOTAL DISTRIBUTION PERCENTAGE | STATUS
  // GROUND FLOOR ...
  // SECOND FLOOR ...
  // THIRD FLOOR ...
  // OVERALL ACCOMPLISHMENT STATUS | 10.24% | 100.00% | 10.24%
  //
  // Actual Tracker:
  //   scope weight = TOTAL on OVERALL row
  //   actual contribution = STATUS on OVERALL row
  //
  // Projected/Schedule Tracker:
  //   projected contribution = PROJECTED / PLANNED / STATUS value on OVERALL row
  //
  // Floor/detail rows are intentionally NOT imported. Hidden rows/columns are already
  // removed server-side by the XLSX visible-only reader.

  // v25.4 — Projected Timeline reader for layouts like:
  // WORK ITEM DESCRIPTION | DURATION IN DAYS | START DATE | END DATE | AMOUNT PER DAY | TOTAL AMOUNT
  // It ignores the daily matrix itself and derives activity weight from TOTAL AMOUNT.
  function parseProjectedTimelineRows(rows){
    const hh=x=>clean(x).toLowerCase()
      .replace(/[^a-z0-9%]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    let best=null;
    for(let ri=0;ri<Math.min(rows.length,120);ri++){
      const h=(rows[ri]||[]).map(hh);
      const activity=h.findIndex(x=>
        x.includes('work item description') ||
        x==='activity' ||
        x.includes('activity') ||
        x==='description'
      );
      const start=h.findIndex(x=>x==='start date'||x.includes('start date')||x==='start');
      const end=h.findIndex(x=>x==='end date'||x.includes('end date')||x.includes('finish date')||x==='end'||x==='finish');
      const amount=h.findIndex(x=>
        x==='total amount' ||
        x.includes('total amount') ||
        x==='amount' ||
        x.includes('contract amount')
      );
      if(activity>=0 && start>=0 && end>=0 && amount>=0){
        best={rowIndex:ri,activity,start,end,amount};
        break;
      }
    }
    if(!best)return [];

    const raw=[];
    for(let r=best.rowIndex+1;r<rows.length;r++){
      const row=rows[r]||[];
      const activity=clean(row[best.activity]);
      if(!activity)continue;

      // Skip floor/section labels and total/summary rows.
      if(/^\d+(st|nd|rd|th)\s*floor$/i.test(activity))continue;
      if(/\b(total projected cost|projected accomplishment|projected accumulative|running accomplishment|grand total|subtotal|total|billing last time|without recoupment|remaining)\b/i.test(activity))continue;

      const start=parseDate(row[best.start]);
      const end=parseDate(row[best.end]);
      const amount=Math.max(0,n(row[best.amount]));
      if(!start||!end||amount<=0)continue;

      raw.push({activity,start_date:start,end_date:end,total_amount:amount});
    }
    if(!raw.length)return [];

    const total=raw.reduce((sum,x)=>sum+x.total_amount,0);
    if(total<=0)return [];

    return raw.map(x=>({
      activity:x.activity,
      start_date:x.start_date,
      end_date:x.end_date,
      weight:x.total_amount/total*100,
      total_amount:x.total_amount,
      summary_only:false,
      timeline_source:true
    }));
  }

  // v25.7 — Exact POC summary reader.
  // Supports multiple side-by-side blocks on the same rows, e.g.:
  // G:L = Ceiling/Cabinetry/Wall/Flooring
  // N:S = Electrical/Plumbing/Glass/General Requirements
  // Each block is detected from its own DESCRIPTION header cell.
  function parseScopeSummaryBlocks(rows,kind){
    const hh=x=>clean(x).toLowerCase()
      .replace(/[^a-z0-9%]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    if(kind!=='actual') return [];

    const out=[];
    const seen=new Set();

    for(let r=0;r<rows.length;r++){
      const row=rows[r]||[];

      // There can be more than one DESCRIPTION header on the same row.
      for(let descCol=0;descCol<row.length;descCol++){
        const h=hh(row[descCol]);
        if(!(h==='description'||h.includes('description'))) continue;

        // Find TOTAL and STATUS only inside this local block, not across the whole row.
        let totalCol=-1,statusCol=-1;
        for(let c=descCol+1;c<Math.min(row.length,descCol+7);c++){
          const hc=hh(row[c]);
          if(totalCol<0 && hc==='total') totalCol=c;
          if(statusCol<0 && (hc==='status'||hc.includes('actual')||hc.includes('accomplishment'))) statusCol=c;
        }
        if(totalCol<0 || statusCol<0) continue;

        // Scope title is normally directly above this DESCRIPTION block.
        let scope='';
        for(let rr=r-1;rr>=Math.max(0,r-4);rr--){
          const candidates=[];
          for(let c=Math.max(0,descCol-1);c<=Math.min((rows[rr]||[]).length-1,descCol+2);c++){
            const val=clean((rows[rr]||[])[c]);
            if(!val)continue;
            if(/description|total|distribution|status|balanced|equivalent|accomplishment/i.test(val))continue;
            if(/%/.test(val))continue;
            candidates.push(val);
          }
          const explicit=candidates.find(x=>/\bworks?\b/i.test(x));
          const cand=explicit || candidates.sort((a,b)=>b.length-a.length)[0];
          if(cand){scope=cand;break;}
        }
        if(!scope)continue;

        // Find the OVERALL row for THIS description column only.
        let overall=null;
        for(let rr=r+1;rr<Math.min(rows.length,r+12);rr++){
          const d=clean((rows[rr]||[])[descCol]);
          if(!d)continue;

          // Stop if a new block header starts in this same column.
          if(rr>r+1 && /^description$/i.test(d))break;

          if(
            /overall.*(accomplishment|status|percentage|progress)/i.test(d) ||
            /overall\s*status/i.test(d) ||
            /total.*(accomplishment|status|progress)/i.test(d)
          ){
            overall=rows[rr]||[];
            break;
          }
        }
        if(!overall)continue;

        const total=Math.max(0,n(overall[totalCol]));
        const status=Math.max(0,n(overall[statusCol]));
        if(total<=0 && status<=0)continue;

        const key=norm(scope);
        if(seen.has(key))continue;
        seen.add(key);

        // v25.8: The user wants the STATUS cell itself to be the Actual %.
        // Keep one row per top-level scope and set weight to 100 so the
        // weighted contribution is exactly the STATUS percentage.
        out.push({
          activity:scope,
          weight:100,
          actual_percent:Math.max(0,Math.min(100,status)),
          source_summary_value:status,
          summary_only:true
        });
      }
    }

    return out;
  }


  function parsePocActualHelperList(rows){
    const out=[];
    for(let r=0;r<rows.length;r++){
      const row=rows[r]||[];
      for(let c=0;c<row.length-1;c++){
        const a=clean(row[c]).toLowerCase();
        if(a==='scope of works' || a==='scope of work'){
          for(let rr=r+1;rr<Math.min(rows.length,r+15);rr++){
            const name=clean((rows[rr]||[])[c]);
            const value=n((rows[rr]||[])[c+1]);
            if(!name)continue;
            if(/total accomp/i.test(name))break;
            if(value<=0)continue;
            out.push({
              activity:name,
              weight:100,
              actual_percent:Math.max(0,Math.min(100,value)),
              source_summary_value:value,
              summary_only:true
            });
          }
          return out;
        }
      }
    }
    return out;
  }


  // v25.8 — Read the exact PROJECTED ACCUMULATIVE ACCOMPLISHMENT %AGE row.
  // The date header is located above the DAY columns; each visible date becomes one point.
  function parseProjectedCumulativeSeries(rows){
    const hh=x=>clean(x).toLowerCase().replace(/[^a-z0-9%]+/g,' ').replace(/\s+/g,' ').trim();
    let targetRow=-1,targetCol=-1;

    for(let r=0;r<rows.length;r++){
      for(let c=0;c<(rows[r]||[]).length;c++){
        const h=hh(rows[r][c]);
        if(
          h.includes('projected accumulative accomplishment') &&
          (h.includes('%') || h.includes('age') || h.includes('percentage'))
        ){
          targetRow=r;
          targetCol=c;
          break;
        }
      }
      if(targetRow>=0)break;
    }
    if(targetRow<0)return [];

    // Search upward for the row containing the dates aligned with the cumulative values.
    let dateRow=-1;
    for(let r=targetRow-1;r>=Math.max(0,targetRow-95);r--){
      let dateHits=0;
      for(let c=targetCol+1;c<(rows[r]||[]).length;c++){
        if(parseDate(rows[r][c]))dateHits++;
      }
      if(dateHits>=2){dateRow=r;break;}
    }
    if(dateRow<0)return [];

    const points=[];
    for(let c=targetCol+1;c<Math.max((rows[dateRow]||[]).length,(rows[targetRow]||[]).length);c++){
      const d=parseDate((rows[dateRow]||[])[c]);
      const raw=(rows[targetRow]||[])[c];
      const pctValue=n(raw);
      if(!d || !/^20\d{2}-\d{2}-\d{2}$/.test(d))continue;
      if(raw==null || clean(raw)==='')continue;
      points.push({progress_date:d,cumulative_percent:Math.max(0,Math.min(100,pctValue))});
    }

    // Dedupe dates, keep last visible value.
    const byDate=new Map();
    points.forEach(p=>byDate.set(p.progress_date,p));
    return [...byDate.values()].sort((a,b)=>a.progress_date.localeCompare(b.progress_date));
  }

  function parseTrackerRows(rows,kind){
    if(kind==='schedule'){
      const timeline=parseProjectedTimelineRows(rows);
      if(timeline.length)return timeline;
    }

    if(kind==='actual'){
      // First choice: exact side-by-side OVERALL STATUS blocks.
      const scopeBlocks=parseScopeSummaryBlocks(rows,kind);
      if(scopeBlocks.length)return scopeBlocks;

      // Second choice: compact 'scope of works' helper list if present.
      const helperList=parsePocActualHelperList(rows);
      if(helperList.length)return helperList;
    }

    const h=detectHeader(rows,kind);
    if(!h)throw new Error(kind==='schedule'
      ? 'Could not auto-detect Schedule columns. Need Activity/Description, Start Date and End Date. Weight is optional.'
      : 'Could not auto-detect Actual Progress columns. Need Activity/Description and Actual/Accomplishment %. Weight is optional.');

    const raw=[];
    for(let i=h.rowIndex+1;i<rows.length;i++){
      const r=rows[i];
      const activity=clean(r[h.cols.activity]);
      if(!activity)continue;
      // Do not import total/subtotal summary rows as activities.
      if(/\b(grand\s*total|sub[-\s]?total|total)\b/i.test(activity))continue;

      if(kind==='schedule'){
        const start=parseDate(r[h.cols.start]),end=parseDate(r[h.cols.end]);
        if(!start||!end)continue;
        raw.push({activity,start_date:start,end_date:end,weight:h.cols.weight!=null?n(r[h.cols.weight]):0});
      }else{
        const actual=Math.max(0,Math.min(100,n(r[h.cols.actual])));
        raw.push({activity,weight:h.cols.weight!=null?n(r[h.cols.weight]):0,actual_percent:actual});
      }
    }
    if(!raw.length)throw new Error(`No usable ${kind==='schedule'?'schedule':'actual progress'} rows found.`);

    // Collapse duplicate/trivially-different activity names before writing to Supabase.
    // This prevents the actual_progress(project_id, activity) unique-key error.
    const byKey=new Map();
    for(const item of raw){
      const key=norm(item.activity)||item.activity.toLowerCase();
      if(!byKey.has(key)){
        byKey.set(key,item);
      }else{
        const prev=byKey.get(key);
        if(kind==='actual'){
          // Keep the most advanced value and best available weight.
          prev.actual_percent=Math.max(n(prev.actual_percent),n(item.actual_percent));
          prev.weight=Math.max(n(prev.weight),n(item.weight));
        }else{
          // Merge duplicate schedule rows into one span.
          prev.start_date=prev.start_date<item.start_date?prev.start_date:item.start_date;
          prev.end_date=prev.end_date>item.end_date?prev.end_date:item.end_date;
          prev.weight=Math.max(n(prev.weight),n(item.weight));
        }
      }
    }
    const out=[...byKey.values()];

    // Schedule weights should represent one 100% project basis. If the source
    // contains category totals/overlapping percentages and exceeds 100%,
    // normalize the imported activities to 100% instead of showing 149%+ planned.
    if(kind==='schedule'){
      const total=out.reduce((sum,x)=>sum+Math.max(0,n(x.weight)),0);
      if(total>100.5){
        out.forEach(x=>{x.weight=Math.max(0,n(x.weight))/total*100});
      }
    }
    return out;
  }

  async function readSheet(link){
    const r=await fetch('/api/read-tracker-sheet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({link})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.error||'Could not read Google Sheet.');
    return data.rows;
  }

  async function saveProjectLink(p,field,value){
    const values={[field]:value||null};
    const {data,error}=await sb.from('projects').update(values).eq('id',p.id).select();
    if(error)throw error;
    const i=(cache.projects||[]).findIndex(x=>String(x.id)===String(p.id));
    if(i>=0)cache.projects[i]={...cache.projects[i],...(data?.[0]||values)};
  }

  async function syncSchedule(p,silent=false){
    if(!p?.schedule_sheet_link)return false;
    const raw=await readSheet(p.schedule_sheet_link);

    // Exact projected basis: PROJECTED ACCUMULATIVE ACCOMPLISHMENT %AGE.
    const projectedSeries=parseProjectedCumulativeSeries(raw);
    if(projectedSeries.length){
      const delSeries=await sb.from('projected_progress_series').delete().eq('project_id',p.id);
      if(delSeries.error)throw delSeries.error;
      const seriesRows=projectedSeries.map(x=>({
        project_id:p.id,
        progress_date:x.progress_date,
        cumulative_percent:x.cumulative_percent,
        source_label:'PROJECTED ACCUMULATIVE ACCOMPLISHMENT %AGE',
        synced_at:new Date().toISOString()
      }));
      const insSeries=await sb.from('projected_progress_series').upsert(seriesRows,{onConflict:'project_id,progress_date'}).select();
      if(insSeries.error)throw insSeries.error;
      cache.projectedSeries=(cache.projectedSeries||[]).filter(x=>String(x.project_id)!==String(p.id)).concat(insSeries.data||seriesRows);
    }

    const sourceRows=parseTrackerRows(raw,'schedule');
    const today=new Date().toISOString().slice(0,10);
    const parsed=sourceRows.map(x=>({
      activity:x.activity,
      // Summary-only projected rows are stored as completed-today items.
      // Their weight is already the visible projected contribution from the Sheet.
      start_date:x.summary_only?today:x.start_date,
      end_date:x.summary_only?today:x.end_date,
      weight:Math.max(0,n(x.weight)),
      project_id:p.id,
      created_by:currentUser.id
    }));
    const del=await sb.from('schedule_items').delete().eq('project_id',p.id);
    if(del.error)throw del.error;
    const ins=await sb.from('schedule_items').insert(parsed).select();
    if(ins.error)throw ins.error;
    cache.schedule=(cache.schedule||[]).filter(x=>String(x.project_id)!==String(p.id)).concat(ins.data||parsed);
    await sb.from('projects').update({tracker_last_sync_at:new Date().toISOString()}).eq('id',p.id);
    if(!silent&&typeof toast==='function')toast(`${parsed.length} schedule activities synced.`);
    return true;
  }

  async function syncActual(p,silent=false){
    if(!p?.actual_progress_sheet_link)return false;
    const raw=await readSheet(p.actual_progress_sheet_link);
    const parsed=parseTrackerRows(raw,'actual').map(x=>({
      activity:x.activity,
      weight:Math.max(0,n(x.weight)),
      actual_percent:Math.max(0,Math.min(100,n(x.actual_percent))),
      project_id:p.id,
      updated_by:currentUser.id,
      updated_at:new Date().toISOString()
    }));
    const del=await sb.from('actual_progress').delete().eq('project_id',p.id);
    if(del.error)throw del.error;
    // Upsert is intentionally used even after cleanup as a second guard against
    // duplicate activity keys from unusual Google Sheet layouts.
    const ins=await sb.from('actual_progress').upsert(parsed,{onConflict:'project_id,activity'}).select();
    if(ins.error)throw ins.error;
    cache.progress=(cache.progress||[]).filter(x=>String(x.project_id)!==String(p.id)).concat(ins.data||parsed);
    await sb.from('projects').update({tracker_last_sync_at:new Date().toISOString()}).eq('id',p.id);
    if(!silent&&typeof toast==='function')toast(`${parsed.length} actual progress activities synced.`);
    return true;
  }

  function matchedRows(pid){
    const sched=(cache.schedule||[]).filter(x=>String(x.project_id)===String(pid));
    const actual=(cache.progress||[]).filter(x=>String(x.project_id)===String(pid));
    return sched.map(s=>({schedule:s,match:bestMatch(s.activity,actual)}));
  }

  // Use schedule weights + fuzzy-matched actual % so planned and actual compare on one common scope basis.
  actualForProject=function(pid){
    const sched=(cache.schedule||[]).filter(x=>String(x.project_id)===String(pid));
    const actual=(cache.progress||[]).filter(x=>String(x.project_id)===String(pid));
    if(sched.length&&actual.length){
      let total=0;
      for(const s of sched){
        const m=bestMatch(s.activity,actual);
        if(m)total+=n(s.weight)*n(m.row.actual_percent)/100;
      }
      return total;
    }
    if(actual.length)return actual.reduce((sum,x)=>sum+n(x.weight)*n(x.actual_percent)/100,0);
    return n(proj(pid)?.progress);
  };

  function renderMatchSummary(pid){
    const box=$('trackerMatchSummary');if(!box)return;
    const sched=(cache.schedule||[]).filter(x=>String(x.project_id)===String(pid));
    const actual=(cache.progress||[]).filter(x=>String(x.project_id)===String(pid));
    if(!sched.length&&!actual.length){box.innerHTML='';return;}
    const used=new Set();let matched=0;
    for(const s of sched){const m=bestMatch(s.activity,actual,used);if(m){matched++;used.add(m.row)}}
    box.innerHTML=`<span><strong>${matched}</strong> matched scopes</span><span><strong>${Math.max(0,sched.length-matched)}</strong> schedule-only</span><span><strong>${Math.max(0,actual.length-used.size)}</strong> actual-only</span><small>Scope names are matched automatically even when wording is slightly different.</small>`;
  }

  // Replace Schedule table item-level Actual with fuzzy matched Actual.
  const baseRenderSchedule=renderSchedule;
  renderSchedule=function(){
    baseRenderSchedule();
    const pid=$('scheduleProject')?.value||$('workspaceProject')?.value||cache.projects[0]?.id;
    if(!pid)return;
    const sched=(cache.schedule||[]).filter(x=>String(x.project_id)===String(pid));
    const actual=(cache.progress||[]).filter(x=>String(x.project_id)===String(pid));
    if(sched.length&&$('scheduleRows')){
      $('scheduleRows').innerHTML=sched.map(r=>{
        const today=new Date(),s=new Date(r.start_date),e=new Date(r.end_date);
        const f=today>=e?100:today<=s?0:Math.max(0,Math.min(100,(today-s)/(e-s||1)*100));
        const m=bestMatch(r.activity,actual);
        const ap=m?.row;
        const label=ap&&norm(ap.activity)!==norm(r.activity)?`<small class="scope-match-note">↔ ${esc(ap.activity)}</small>`:'';
        return `<tr><td class="check-col"><input class="schedule-row-check" type="checkbox" value="${r.id||''}"></td><td>${esc(r.activity)}${label}</td><td>${r.start_date}</td><td>${r.end_date}</td><td>${pct(r.weight)}</td><td>${pct(f)}</td><td>${pct(ap?.actual_percent||0)}</td><td>${pct(n(r.weight)*n(ap?.actual_percent)/100)}</td><td></td></tr>`;
      }).join('');
    }
    renderMatchSummary(pid);
    updateTrackerLinkUI();
  };

  const baseRenderProgress=renderProgress;
  renderProgress=function(){
    baseRenderProgress();
    const pid=$('progressProject')?.value||$('workspaceProject')?.value||cache.projects[0]?.id;
    renderMatchSummary(pid);
    updateTrackerLinkUI();
  };

  function updateTrackerLinkUI(){
    const sp=selectedProject('scheduleProject');
    const ap=selectedProject('progressProject');
    if($('scheduleSheetLink')&&document.activeElement!==$('scheduleSheetLink'))$('scheduleSheetLink').value=sp?.schedule_sheet_link||'';
    if($('actualSheetLink')&&document.activeElement!==$('actualSheetLink'))$('actualSheetLink').value=ap?.actual_progress_sheet_link||'';
    if($('scheduleSheetStatus'))$('scheduleSheetStatus').textContent=sp?.schedule_sheet_link?'Live link saved':'Not linked';
    if($('actualSheetStatus'))$('actualSheetStatus').textContent=ap?.actual_progress_sheet_link?'Live link saved':'Not linked';
  }

  $('saveScheduleSheetLinkBtn').onclick=async()=>{
    const p=selectedProject('scheduleProject');if(!p)return alert('Select a project first.');
    try{
      await saveProjectLink(p,'schedule_sheet_link',$('scheduleSheetLink').value.trim());
      updateTrackerLinkUI();
      toast('Schedule link saved. Click Sync Now when ready.');
    }catch(e){alert(e.message)}
  };
  $('saveActualSheetLinkBtn').onclick=async()=>{
    const p=selectedProject('progressProject');if(!p)return alert('Select a project first.');
    try{
      await saveProjectLink(p,'actual_progress_sheet_link',$('actualSheetLink').value.trim());
      updateTrackerLinkUI();
      toast('Actual Progress link saved. Click Sync Now when ready.');
    }catch(e){alert(e.message)}
  };
  $('syncScheduleSheetBtn').onclick=async()=>{const p=selectedProject('scheduleProject');if(!p)return alert('Select a project.');try{await syncSchedule(p);renderSchedule();renderProgress();renderDashboard()}catch(e){alert(e.message)}};
  $('syncActualSheetBtn').onclick=async()=>{const p=selectedProject('progressProject');if(!p)return alert('Select a project.');try{await syncActual(p);renderProgress();renderSchedule();renderDashboard()}catch(e){alert(e.message)}};

  $('scheduleProject').addEventListener('change',()=>updateTrackerLinkUI());
  $('progressProject').addEventListener('change',()=>updateTrackerLinkUI());
  setTimeout(updateTrackerLinkUI,400);

  // v25.1 exposes only the small sync helpers needed by the live-sync controller.
  window.syncSchedule=syncSchedule;
  window.syncActual=syncActual;
  window.updateTrackerLinkUI=updateTrackerLinkUI;

})();
