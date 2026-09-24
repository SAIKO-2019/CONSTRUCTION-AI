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
    if(!v)return null;
    const s=clean(v);
    const d=new Date(s);
    if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
    const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if(m){
      let y=Number(m[3]);if(y<100)y+=2000;
      const d2=new Date(y,Number(m[1])-1,Number(m[2]));
      if(!Number.isNaN(d2.getTime()))return d2.toISOString().slice(0,10);
    }
    return null;
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
      if(/\b(total projected cost|projected accomplishment|projected accumulative|grand total|subtotal|total)\b/i.test(activity))continue;

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

  function parseScopeSummaryBlocks(rows,kind){
    const hh=x=>clean(x).toLowerCase()
      .replace(/[^a-z0-9%]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();

    const out=[];

    for(let i=0;i<rows.length;i++){
      const hdr=(rows[i]||[]).map(hh);
      const descCol=hdr.findIndex(h=>h==='description'||h.includes('description'));
      const totalCol=hdr.findIndex(h=>h==='total');
      if(descCol<0 || totalCol<0) continue;

      let valueCol=-1;
      if(kind==='actual'){
        valueCol=hdr.findIndex(h=>h==='status' || h.includes('status') || h.includes('actual') || h.includes('accomplishment'));
      }else{
        valueCol=hdr.findIndex(h=>
          h.includes('projected') ||
          h.includes('planned') ||
          h==='status' ||
          h.includes('status')
        );
      }
      if(valueCol<0) continue;

      // Find the scope heading immediately above the table header.
      let scope='';
      for(let r=i-1;r>=Math.max(0,i-6);r--){
        const vals=(rows[r]||[]).map(clean).filter(Boolean);
        if(!vals.length) continue;
        const cand=vals.find(x=>
          /[A-Za-z]/.test(x) &&
          !/%/.test(x) &&
          !/description|total|distribution|status|projected|planned|actual|accomplishment/i.test(x)
        );
        if(cand){
          scope=cand;
          break;
        }
      }
      if(!scope) continue;

      // Read the OVERALL summary row only.
      let overall=null;
      for(let r=i+1;r<Math.min(rows.length,i+30);r++){
        const row=rows[r]||[];
        const d=hh(row[descCol]);

        if(r>i+1 && (d==='description' || d.includes('description'))) break;

        if(
          /overall.*(accomplishment|status|percentage|progress)/i.test(clean(row[descCol])) ||
          /total.*(accomplishment|status|progress)/i.test(clean(row[descCol]))
        ){
          overall=row;
          break;
        }
      }
      if(!overall) continue;

      const total=Math.max(0,n(overall[totalCol]));
      const value=Math.max(0,n(overall[valueCol]));
      if(total<=0 && value<=0) continue;

      if(kind==='actual'){
        const scopePercent=total>0 ? Math.max(0,Math.min(100,value/total*100)) : 0;
        out.push({
          activity:scope,
          weight:total,
          actual_percent:scopePercent,
          source_summary_value:value,
          summary_only:true
        });
      }else{
        out.push({
          activity:scope,
          weight:value,
          source_summary_value:value,
          summary_only:true
        });
      }
    }

    const seen=new Set();
    return out.filter(item=>{
      const key=norm(item.activity)||item.activity.toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseTrackerRows(rows,kind){
    if(kind==='schedule'){
      const timeline=parseProjectedTimelineRows(rows);
      if(timeline.length)return timeline;
    }

    // Prefer the user's section/block summary layout.
    const scopeBlocks=parseScopeSummaryBlocks(rows,kind);
    if(scopeBlocks.length) return scopeBlocks;

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
