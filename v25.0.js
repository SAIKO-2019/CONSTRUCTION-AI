// SAIKO Construction AI v25.0
// Manual Sync only. Schedule page = planned only. Actual page = actual only.
// Planned-vs-Actual comparison lives on Dashboard.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};

  // Schedule page: planned data only.
  renderSchedule=function(){
    const pid=$('scheduleProject').value||cache.projects[0]?.id;
    if(pid&&!$('scheduleProject').value)$('scheduleProject').value=pid;
    const rows=scheduleData(pid);
    const planned=plannedForProject(pid);
    const remaining=Math.max(0,100-planned);
    $('scheduleSummary').innerHTML=[
      ['Planned Today',pct(planned)],
      ['Remaining Plan',pct(remaining)],
      ['Activities',rows.length],
      ['Data Source',proj(pid)?.schedule_sheet_link?'Google Sheet':'Not linked']
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('scheduleRows').innerHTML=rows.length?rows.map(r=>{
      const today=new Date(),s=new Date(r.start_date),e=new Date(r.end_date);
      const f=today>=e?100:today<=s?0:Math.max(0,Math.min(100,(today-s)/(e-s||1)*100));
      return `<tr>
        <td class="check-col"><input class="schedule-row-check" type="checkbox" value="${r.id}" ${selectedScheduleIds.has(String(r.id))?'checked':''}></td>
        <td>${esc(r.activity)}</td><td>${r.start_date}</td><td>${r.end_date}</td><td>${pct(r.weight)}</td><td>${pct(f)}</td>
        <td><button class="danger-link" onclick="deleteScheduleItem('${r.id}')">Delete</button></td>
      </tr>`;
    }).join(''):'<tr><td colspan="7" class="empty">Save the Schedule Google Sheet link, then click Sync Now.</td></tr>';
    wireBulkChecks('schedule-row-check',selectedScheduleIds,()=>bulkUI('schedule',selectedScheduleIds,rows));
    bulkUI('schedule',selectedScheduleIds,rows);
  };

  // Actual page: actual data only, no Planned / Variance comparison here.
  renderProgress=function(){
    const pid=$('progressProject').value||cache.projects[0]?.id;
    if(pid&&!$('progressProject').value)$('progressProject').value=pid;
    const rows=cache.progress.filter(x=>String(x.project_id)===String(pid));
    const actual=actualForProject(pid);
    const remaining=Math.max(0,100-actual);
    $('progressSummary').innerHTML=[
      ['Actual Accomplishment',pct(actual)],
      ['Remaining',pct(remaining)],
      ['Activities',rows.length],
      ['Data Source',proj(pid)?.actual_progress_sheet_link?'Google Sheet':'Not linked']
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('progressRows').innerHTML=rows.length?rows.map(r=>`<tr>
      <td class="check-col"><input class="progress-row-check" type="checkbox" value="${r.id}" ${selectedProgressIds.has(String(r.id))?'checked':''}></td>
      <td>${esc(r.activity)}</td>
      <td>${pct(r.weight)}</td>
      <td>${pct(r.actual_percent)}</td>
      <td>${pct(n(r.weight)*n(r.actual_percent)/100)}</td>
      <td>${r.updated_at?new Date(r.updated_at).toLocaleString():'—'}</td>
      <td><button class="danger-link" onclick="deleteProgress('${r.id}')">Delete</button></td>
    </tr>`).join(''):'<tr><td colspan="7" class="empty">Save the Actual Progress Google Sheet link, then click Sync Now.</td></tr>';
    wireBulkChecks('progress-row-check',selectedProgressIds,()=>bulkUI('progress',selectedProgressIds,rows));
    bulkUI('progress',selectedProgressIds,rows);
  };


  // v25.3: Actual Tracker remains independent from projected/schedule data.
  // Each Actual scope contributes exactly its visible STATUS summary value because
  // weight × actual_percent / 100 reconstructs that summary contribution.
  actualForProject=function(pid){
    const rows=(cache.progress||[]).filter(r=>String(r.project_id)===String(pid));
    if(rows.length){
      return rows.reduce((sum,r)=>sum+(n(r.weight)*n(r.actual_percent)/100),0);
    }
    return n(proj(pid)?.progress);
  };

  // Dashboard owns the comparison.
  const baseDash=renderDashboard;
  renderDashboard=function(){
    baseDash();
    const active=cache.projects.filter(p=>!['Completed'].includes(p.status));
    $('dashProjects').innerHTML=active.length?active.map(p=>{
      const planned=plannedForProject(p.id),actual=actualForProject(p.id),variance=actual-planned;
      const label=variance<-2?'Behind':variance>2?'Ahead':'On Track';
      return `<tr>
        <td><strong>${esc(p.project_name)}</strong><br><small class="muted">${label}</small></td>
        <td>${esc(p.status)}</td>
        <td>${pct(actual)}</td>
        <td>${pct(planned)}</td>
        <td class="${variance<0?'negative':'positive'}">${pct(variance)}</td>
      </tr>`;
    }).join(''):'<tr><td colspan="5" class="empty">No projects yet.</td></tr>';
  };
})();
