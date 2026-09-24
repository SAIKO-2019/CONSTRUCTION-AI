// SAIKO Construction AI v26.2
// Tracker pages mirror the linked Google Sheet tab as view-only.
// Hidden rows/columns are filtered server-side. Calculations remain internal.
(function(){
  window.trackerSheetViews=window.trackerSheetViews||{schedule:{},actual:{}};

  function e(v){
    return esc(String(v??''));
  }

  function selectedPid(kind){
    const id=kind==='schedule'?'scheduleProject':'progressProject';
    return $(id)?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function trimTrailingEmpty(rows){
    if(!rows?.length)return [];
    let max=0;
    for(const row of rows){
      for(let c=row.length-1;c>=0;c--){
        if(String(row[c]??'').trim()!==''){
          max=Math.max(max,c+1);
          break;
        }
      }
    }
    return rows.map(r=>r.slice(0,max));
  }

  function renderMirror(kind){
    const pid=selectedPid(kind);
    const target=$(kind==='schedule'?'scheduleSheetMirror':'actualSheetMirror');
    const status=$(kind==='schedule'?'scheduleMirrorStatus':'actualMirrorStatus');
    if(!target)return;

    const rows=trimTrailingEmpty(window.trackerSheetViews?.[kind]?.[String(pid)]||[]);
    if(!rows.length){
      target.innerHTML=`<div class="empty">No visible linked-sheet data loaded yet. Click <strong>Sync Now</strong>.</div>`;
      if(status)status.textContent='WAITING';
      return;
    }

    const width=Math.max(...rows.map(r=>r.length),0);
    const colHeads=Array.from({length:width},(_,i)=>`<th class="sheet-col-letter">${columnLetter(i+1)}</th>`).join('');

    const body=rows.map((row,ri)=>{
      const cells=Array.from({length:width},(_,ci)=>{
        const val=row[ci]??'';
        const txt=String(val);
        const cls=/^-?\d[\d,.]*%$/.test(txt.trim())?' numeric-cell':'';
        return `<td class="sheet-mirror-cell${cls}" title="${e(txt)}">${e(txt)}</td>`;
      }).join('');
      return `<tr><th class="sheet-row-number">${ri+1}</th>${cells}</tr>`;
    }).join('');

    target.innerHTML=`
      <div class="sheet-mirror-scroll">
        <table class="sheet-mirror-table">
          <thead><tr><th class="sheet-corner"></th>${colHeads}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;

    if(status)status.textContent=`LIVE • ${rows.length} VISIBLE ROWS`;
  }

  function columnLetter(n){
    let out='';
    while(n>0){
      n--;
      out=String.fromCharCode(65+(n%26))+out;
      n=Math.floor(n/26);
    }
    return out;
  }

  // Keep the existing calculation renderers, but hide their normalized tracker-row tables.
  const baseSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    let out;
    try{out=baseSchedule.apply(this,arguments)}catch(err){
      // Mirror should still render even if a calculation block encounters a stale UI element.
      console.warn('schedule calculation render',err);
    }
    renderMirror('schedule');
    return out;
  };

  const baseProgress=window.renderProgress;
  window.renderProgress=function(){
    let out;
    try{out=baseProgress.apply(this,arguments)}catch(err){
      console.warn('actual calculation render',err);
    }
    renderMirror('actual');
    return out;
  };

  // Render immediately after every successful Sync Now.
  const scheduleBtn=$('syncScheduleSheetBtn');
  if(scheduleBtn&&!scheduleBtn.dataset.v262Mirror){
    scheduleBtn.dataset.v262Mirror='1';
    scheduleBtn.addEventListener('click',()=>setTimeout(()=>renderMirror('schedule'),800));
  }
  const actualBtn=$('syncActualSheetBtn');
  if(actualBtn&&!actualBtn.dataset.v262Mirror){
    actualBtn.dataset.v262Mirror='1';
    actualBtn.addEventListener('click',()=>setTimeout(()=>renderMirror('actual'),800));
  }

  if($('scheduleProject'))$('scheduleProject').addEventListener('change',()=>renderMirror('schedule'),{passive:true});
  if($('progressProject'))$('progressProject').addEventListener('change',()=>renderMirror('actual'),{passive:true});

  // 10-second live sync already exists in v25.2/v25.1; after that sync calls renderSchedule/renderProgress,
  // these mirrors automatically repaint with the newest visible rows.
  setTimeout(()=>{
    renderMirror('schedule');
    renderMirror('actual');
  },500);

  window.renderTrackerSheetMirror=renderMirror;
})();
